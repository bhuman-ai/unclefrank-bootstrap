# Interface.md — Developer Platform UI Specification

## UI Consistency Rules

### Layout Rules
- **Navigation Placement**: Primary navigation must be consistent across all pages
- **Header Structure**: Page headers must follow pattern: Title > Subtitle > Actions
- **Spacing Units**: Use 8px grid system for all spacing (8, 16, 24, 32px)
- **Content Width**: Main content must not exceed 1200px width
- **Sidebar Width**: Fixed at 280px when present

### Component Standards
- **Button Hierarchy**: Primary > Secondary > Tertiary visual hierarchy required
- **Form Validation**: Real-time validation required for all inputs
- **Loading States**: All async operations must show loading indicators
- **Error Display**: Errors must appear inline and be dismissible
- **Modal Size**: Modals limited to 600px width maximum

### Typography Rules
- **Heading Scale**: H1 (32px), H2 (24px), H3 (20px), H4 (16px)
- **Body Text**: 14px base size, 1.5x line height minimum
- **Link Styling**: Underline on hover, consistent color scheme
- **Code Display**: Monospace font required for all code blocks

### Color Consistency
- **Primary Colors**: Must maintain 4.5:1 contrast ratio minimum
- **Status Colors**: Green (success), Red (error), Yellow (warning), Blue (info)
- **Background Colors**: Light theme default, dark theme support required
- **Border Colors**: Consistent border radius (4px default)

### Interaction Requirements
- **Click Targets**: Minimum 44px touch target size
- **Hover States**: All interactive elements must have hover feedback
- **Focus States**: Keyboard navigation support required
- **Disabled States**: Clear visual distinction for disabled elements

### Accessibility Rules
- **Screen Reader**: All content must be screen reader accessible
- **Keyboard Navigation**: Tab order must be logical
- **Color Independence**: Information cannot rely solely on color
- **Alt Text**: All images require descriptive alt text