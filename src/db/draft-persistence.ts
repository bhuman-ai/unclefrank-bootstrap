/**
 * Draft Persistence Layer
 * SACRED PRINCIPLE: Real database storage, not file system nonsense
 * Uncle Frank says: "Files get lost, databases persist"
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/unclefrank',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

export interface Draft {
    id: string;
    title: string;
    content: string;
    type: 'project' | 'task' | 'checkpoint' | 'documentation';
    status: 'draft' | 'validated' | 'approved' | 'rejected';
    metadata: any;
    created_at: Date;
    updated_at: Date;
    created_by: string;
    version: number;
    parent_id?: string;
}

export interface DraftRevision {
    id: string;
    draft_id: string;
    content: string;
    changes: string;
    version: number;
    created_at: Date;
    created_by: string;
}

export class DraftPersistence {
    /**
     * Initialize database schema
     */
    async initializeSchema(): Promise<void> {
        console.log('🗄️ Frank is setting up the REAL database...');
        
        try {
            // Create drafts table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS drafts (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    title VARCHAR(255) NOT NULL,
                    content TEXT NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    status VARCHAR(50) NOT NULL DEFAULT 'draft',
                    metadata JSONB DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by VARCHAR(255) DEFAULT 'system',
                    version INTEGER DEFAULT 1,
                    parent_id UUID REFERENCES drafts(id) ON DELETE SET NULL,
                    CONSTRAINT draft_type_check CHECK (type IN ('project', 'task', 'checkpoint', 'documentation')),
                    CONSTRAINT draft_status_check CHECK (status IN ('draft', 'validated', 'approved', 'rejected'))
                );
            `);

            // Create draft revisions table
            await pool.query(`
                CREATE TABLE IF NOT EXISTS draft_revisions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    draft_id UUID NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
                    content TEXT NOT NULL,
                    changes TEXT,
                    version INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by VARCHAR(255) DEFAULT 'system',
                    CONSTRAINT unique_draft_version UNIQUE (draft_id, version)
                );
            `);

            // Create indexes for performance
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
                CREATE INDEX IF NOT EXISTS idx_drafts_type ON drafts(type);
                CREATE INDEX IF NOT EXISTS idx_drafts_created_at ON drafts(created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_draft_revisions_draft_id ON draft_revisions(draft_id);
            `);

            // Create update trigger for updated_at
            await pool.query(`
                CREATE OR REPLACE FUNCTION update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$ language 'plpgsql';
            `);

            await pool.query(`
                DROP TRIGGER IF EXISTS update_drafts_updated_at ON drafts;
                CREATE TRIGGER update_drafts_updated_at 
                BEFORE UPDATE ON drafts 
                FOR EACH ROW 
                EXECUTE FUNCTION update_updated_at_column();
            `);

            console.log('✅ Database schema initialized');
        } catch (error) {
            console.error('❌ Failed to initialize database schema:', error);
            throw error;
        }
    }

    /**
     * Create a new draft
     */
    async createDraft(draft: Omit<Draft, 'id' | 'created_at' | 'updated_at'>): Promise<Draft> {
        console.log(`📝 Creating draft: ${draft.title}`);
        
        const query = `
            INSERT INTO drafts (title, content, type, status, metadata, created_by, version, parent_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        
        try {
            const result = await pool.query(query, [
                draft.title,
                draft.content,
                draft.type,
                draft.status || 'draft',
                JSON.stringify(draft.metadata || {}),
                draft.created_by || 'system',
                draft.version || 1,
                draft.parent_id || null
            ]);
            
            const createdDraft = result.rows[0];
            
            // Create initial revision
            await this.createRevision(createdDraft.id, createdDraft.content, 'Initial draft', 1, draft.created_by);
            
            return createdDraft;
        } catch (error) {
            console.error('Failed to create draft:', error);
            throw error;
        }
    }

    /**
     * Update an existing draft
     */
    async updateDraft(id: string, updates: Partial<Draft>): Promise<Draft> {
        console.log(`📝 Updating draft: ${id}`);
        
        // Get current draft for versioning
        const currentDraft = await this.getDraft(id);
        if (!currentDraft) {
            throw new Error(`Draft ${id} not found`);
        }
        
        const newVersion = currentDraft.version + 1;
        
        const query = `
            UPDATE drafts 
            SET title = COALESCE($2, title),
                content = COALESCE($3, content),
                type = COALESCE($4, type),
                status = COALESCE($5, status),
                metadata = COALESCE($6, metadata),
                version = $7
            WHERE id = $1
            RETURNING *
        `;
        
        try {
            const result = await pool.query(query, [
                id,
                updates.title,
                updates.content,
                updates.type,
                updates.status,
                updates.metadata ? JSON.stringify(updates.metadata) : null,
                newVersion
            ]);
            
            const updatedDraft = result.rows[0];
            
            // Create revision if content changed
            if (updates.content && updates.content !== currentDraft.content) {
                await this.createRevision(
                    id, 
                    updates.content, 
                    'Content updated', 
                    newVersion, 
                    updates.created_by || 'system'
                );
            }
            
            return updatedDraft;
        } catch (error) {
            console.error('Failed to update draft:', error);
            throw error;
        }
    }

    /**
     * Get a draft by ID
     */
    async getDraft(id: string): Promise<Draft | null> {
        const query = 'SELECT * FROM drafts WHERE id = $1';
        
        try {
            const result = await pool.query(query, [id]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Failed to get draft:', error);
            throw error;
        }
    }

    /**
     * Get drafts by status
     */
    async getDraftsByStatus(status: string): Promise<Draft[]> {
        const query = 'SELECT * FROM drafts WHERE status = $1 ORDER BY created_at DESC';
        
        try {
            const result = await pool.query(query, [status]);
            return result.rows;
        } catch (error) {
            console.error('Failed to get drafts by status:', error);
            throw error;
        }
    }

    /**
     * Get drafts by type
     */
    async getDraftsByType(type: string): Promise<Draft[]> {
        const query = 'SELECT * FROM drafts WHERE type = $1 ORDER BY created_at DESC';
        
        try {
            const result = await pool.query(query, [type]);
            return result.rows;
        } catch (error) {
            console.error('Failed to get drafts by type:', error);
            throw error;
        }
    }

    /**
     * Delete a draft
     */
    async deleteDraft(id: string): Promise<boolean> {
        console.log(`🗑️ Deleting draft: ${id}`);
        
        const query = 'DELETE FROM drafts WHERE id = $1';
        
        try {
            const result = await pool.query(query, [id]);
            return result.rowCount > 0;
        } catch (error) {
            console.error('Failed to delete draft:', error);
            throw error;
        }
    }

    /**
     * Create a draft revision
     */
    private async createRevision(
        draftId: string, 
        content: string, 
        changes: string, 
        version: number, 
        createdBy: string
    ): Promise<void> {
        const query = `
            INSERT INTO draft_revisions (draft_id, content, changes, version, created_by)
            VALUES ($1, $2, $3, $4, $5)
        `;
        
        try {
            await pool.query(query, [draftId, content, changes, version, createdBy]);
        } catch (error) {
            console.error('Failed to create revision:', error);
            // Don't throw - revisions are non-critical
        }
    }

    /**
     * Get draft revisions
     */
    async getDraftRevisions(draftId: string): Promise<DraftRevision[]> {
        const query = `
            SELECT * FROM draft_revisions 
            WHERE draft_id = $1 
            ORDER BY version DESC
        `;
        
        try {
            const result = await pool.query(query, [draftId]);
            return result.rows;
        } catch (error) {
            console.error('Failed to get revisions:', error);
            throw error;
        }
    }

    /**
     * Validate draft status transition
     */
    async validateStatusTransition(id: string, newStatus: string): Promise<boolean> {
        const draft = await this.getDraft(id);
        if (!draft) return false;
        
        // Define valid transitions
        const validTransitions = {
            'draft': ['validated', 'rejected'],
            'validated': ['approved', 'rejected', 'draft'],
            'approved': ['draft'], // Can go back to draft for revisions
            'rejected': ['draft']
        };
        
        const allowedStatuses = validTransitions[draft.status] || [];
        return allowedStatuses.includes(newStatus);
    }

    /**
     * Search drafts
     */
    async searchDrafts(searchTerm: string): Promise<Draft[]> {
        const query = `
            SELECT * FROM drafts 
            WHERE title ILIKE $1 OR content ILIKE $1
            ORDER BY created_at DESC
            LIMIT 50
        `;
        
        try {
            const result = await pool.query(query, [`%${searchTerm}%`]);
            return result.rows;
        } catch (error) {
            console.error('Failed to search drafts:', error);
            throw error;
        }
    }

    /**
     * Get draft statistics
     */
    async getDraftStats(): Promise<any> {
        const query = `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'draft' THEN 1 END) as drafts,
                COUNT(CASE WHEN status = 'validated' THEN 1 END) as validated,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
                COUNT(CASE WHEN type = 'project' THEN 1 END) as projects,
                COUNT(CASE WHEN type = 'task' THEN 1 END) as tasks,
                COUNT(CASE WHEN type = 'checkpoint' THEN 1 END) as checkpoints
            FROM drafts
        `;
        
        try {
            const result = await pool.query(query);
            return result.rows[0];
        } catch (error) {
            console.error('Failed to get stats:', error);
            throw error;
        }
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<boolean> {
        try {
            const result = await pool.query('SELECT NOW()');
            return !!result.rows[0];
        } catch (error) {
            console.error('Database health check failed:', error);
            return false;
        }
    }
}

// Export singleton
export const draftPersistence = new DraftPersistence();