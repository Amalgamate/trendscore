# Timetable PDF Export - Enhanced Implementation

## Overview
This implementation provides a beautiful, professional PDF export for class timetables with the following improvements:

### ✨ Key Features

1. **Professional Logo Header**
   - School logo centered at the top
   - Beautiful gradient background (purple theme)
   - Class name and date information
   - Professional metadata display

2. **Stunning Table Design**
   - Gradient headers with clear visual hierarchy
   - Alternating row colors for readability
   - Color-coded time slots with distinct styling
   - Beautiful lesson cards with gradients

3. **Print-Optimized**
   - High-quality PDF output using html2canvas + jsPDF
   - Proper page breaks and spacing
   - Color-preserving print styles
   - Optimized for A4 paper size

4. **Responsive Styling**
   - Different styles for screen view vs. print
   - Interactive elements hidden in PDF
   - Professional alignment and spacing
   - Box-shadow and gradient preservation

## Component Structure

### TimetablePDFHeader
Located in: `src/components/CBCGrading/shared/TimetablePDFHeader.jsx`

Displays the PDF header with:
- School logo
- "CLASS TIMETABLE" title
- School name/subtitle
- Metadata (Class, Date, Generated date)
- Professional styling with gradients

**Props:**
- `schoolName` - School name to display (default: "School Timetable")
- `selectedClass` - Class name/identifier
- `weekInfo` - Week information (date range or week number)
- `className` - Additional CSS classes

### TimetablePDFWrapper
Located in: `src/components/CBCGrading/shared/TimetablePDFWrapper.jsx`

Wraps the timetable content and applies professional styling:
- Header with TimetablePDFHeader component
- Beautiful table styling
- Lesson card design with gradients
- Print-specific CSS optimizations
- Color-preserving print styles

**Props:**
- `children` - Timetable table element
- `schoolName` - School name
- `selectedClass` - Class identifier
- `weekInfo` - Week information
- `className` - Additional CSS classes

## CSS Features

### Table Styling
```css
- Header background: Gradient (light gray to lighter gray)
- Header border: 2px solid purple (#667eea)
- Time slots: Light purple background (#f0f3ff)
- Row hover: Light background change
- Alternating rows: Slightly different background
```

### Lesson Cards
```css
- Background: Purple gradient (667eea → 764ba2)
- Border: Left 3px solid dark purple
- Padding: Optimized for readability
- Shadow: Subtle shadow for depth
- Font: Bold subject, regular details
```

### Print Optimization
```css
- Color adjustment: exact (-webkit-print-color-adjust: exact)
- Borders: Preserved with specificity
- Gradients: Maintained in PDF output
- Page breaks: Avoided for rows and cards
```

## Usage in TimetablePage

### Import
```jsx
import TimetablePDFWrapper from '../shared/TimetablePDFWrapper';
```

### Wrap the Table
```jsx
<TimetablePDFWrapper 
  schoolName="School Timetable"
  selectedClass={getSelectedClass()?.name || `${getSelectedClass()?.grade} ${getSelectedClass()?.stream}`.trim()}
  weekInfo={new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  })}
>
  <table className="w-full border-collapse">
    {/* Table content */}
  </table>
</TimetablePDFWrapper>
```

### Update Lesson Cards
```jsx
{lessons.map(lesson => (
  <div 
    key={lesson.id} 
    className="lesson-card cursor-pointer" 
    onClick={() => { setSelectedDay(day); openEditModal(lesson, day); }}
  >
    <div className="lesson-card-subject">{lesson.subject}</div>
    <div className="lesson-card-details">
      <span className="lesson-card-detail-item">{lesson.teacherName}</span>
      <span className="lesson-card-detail-item">•</span>
      <span className="lesson-card-detail-item">{lesson.room}</span>
    </div>
  </div>
))}
```

## PDF Export Workflow

1. User clicks "Download PDF" button on the Timetable page
2. `handleDownloadWeekPdf()` is called
3. `generateHighFidelityPDF('week-at-a-glance-content', filename, opts)` is invoked
4. The PDF generator:
   - Captures the element with html2canvas at 4x scale
   - Converts to jsPDF format (A4 portrait)
   - Automatically displays print-only header in PDF
   - Applies print-specific CSS
   - Preserves colors and gradients
   - Downloads as PDF file

## Styling Classes

### Print-Only Elements
```css
.print-only {
  display: none;  /* Hidden on screen */
}

@media print {
  .print-only {
    display: block;  /* Shown in PDF/print */
  }
}
```

### Lesson Card Classes
- `.lesson-card` - Main container with gradient
- `.lesson-card-subject` - Bold subject name
- `.lesson-card-details` - Teacher and room details
- `.lesson-card-detail-item` - Individual detail span

### Table Classes
- `.timetable-pdf-wrapper` - Main wrapper
- `.empty-slot` - Empty time slot styling

## Color Scheme

- **Primary**: #667eea (Iris Blue)
- **Secondary**: #764ba2 (Purple)
- **Accent**: #5a67d8 (Darker Blue)
- **Background**: #f0f3ff (Light Purple)
- **Text**: #2d3748 (Dark Gray)
- **Borders**: #e2e8f0 (Light Gray)

## Print Media Queries

All components use `@media print` to:
- Hide interactive elements
- Preserve gradients with `-webkit-print-color-adjust: exact`
- Adjust padding and sizing for PDF format
- Maintain color accuracy
- Optimize for A4 paper size

## Browser Compatibility

- Chrome/Chromium: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (with -webkit prefixes)
- Edge: ✅ Full support

## Future Enhancements

1. **Custom Colors**: Allow school to set brand colors
2. **Logo Upload**: Upload custom school logo
3. **PDF Footer**: Add footer with school contact info
4. **Landscape Mode**: Support landscape orientation
5. **Multiple Pages**: Handle large timetables with page breaks
6. **Email Integration**: Send PDF directly to parents

## Troubleshooting

### Logo Not Showing in PDF
- Ensure `/public/logo-maskable.png` exists
- Check browser console for image load errors
- Verify CORS settings allow image loading

### Colors Not Preserving in PDF
- Use Chrome/Chromium for best results
- Check print preview before downloading
- Ensure `-webkit-print-color-adjust: exact` is applied

### Layout Issues
- Clear browser cache and reload
- Try Chrome's "Save as PDF" instead of direct PDF library
- Adjust page margins in print settings

## Files Modified

1. `src/components/CBCGrading/pages/TimetablePage.jsx`
   - Added TimetablePDFWrapper import
   - Wrapped timetable content
   - Updated lesson card markup
   - Added print optimization styles

2. `src/components/CBCGrading/shared/TimetablePDFWrapper.jsx` (NEW)
   - Professional table wrapper
   - Beautiful styling and gradients
   - Print-specific CSS
   - Integrates TimetablePDFHeader

3. `src/components/CBCGrading/shared/TimetablePDFHeader.jsx` (NEW)
   - Logo header component
   - Metadata display
   - Professional gradient design
   - Print-only styling
