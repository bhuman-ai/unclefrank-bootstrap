import { createInterface } from 'readline';
import chalk from 'chalk';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

export async function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(chalk.cyan(`\n${question} `), (answer) => {
      resolve(answer.trim());
    });
  });
}

export async function confirm(question: string): Promise<boolean> {
  const answer = await prompt(`${question} (y/n):`);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

export async function showDiff(original: string, modified: string, title: string): Promise<void> {
  console.log(chalk.yellow(`\n=== ${title} ===`));
  console.log(chalk.red('--- Original'));
  console.log(chalk.green('+++ Modified'));
  console.log(chalk.gray('─'.repeat(80)));
  
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  
  const maxLines = Math.max(originalLines.length, modifiedLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const origLine = originalLines[i] || '';
    const modLine = modifiedLines[i] || '';
    
    if (origLine === modLine) {
      console.log(`  ${origLine}`);
    } else if (i >= originalLines.length) {
      console.log(chalk.green(`+ ${modLine}`));
    } else if (i >= modifiedLines.length) {
      console.log(chalk.red(`- ${origLine}`));
    } else {
      console.log(chalk.red(`- ${origLine}`));
      console.log(chalk.green(`+ ${modLine}`));
    }
  }
  
  console.log(chalk.gray('─'.repeat(80)));
}

export function showCheckpointSummary(checkpoints: any[]): void {
  console.log(chalk.yellow('\n=== Checkpoint Summary ==='));
  checkpoints.forEach((cp, index) => {
    console.log(`${index + 1}. ${chalk.bold(cp.name)}`);
    console.log(`   Objective: ${cp.objective}`);
    console.log(`   Blocking: ${cp.blocking ? chalk.red('Yes') : chalk.green('No')}`);
    console.log(`   Pass Criteria: ${cp.passCriteria.length} tests`);
  });
}

export function cleanup(): void {
  rl.close();
}