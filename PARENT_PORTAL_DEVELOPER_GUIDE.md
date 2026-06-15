# Parent Portal Developer Guide

## Quick Start

The Parent Portal is a mobile-first redesign of the TrendSCORE parent experience. When a parent user logs in on mobile, they automatically see the new portal experience instead of the traditional admin interface.

## How to Test the Parent Portal

### 1. Login as a Parent
- Use credentials for a user with role `PARENT`
- Access the system on a mobile device or use mobile browser emulation
- You should see the redesigned parent portal

### 2. Navigate the Portal
Use the bottom navigation to move between sections:
- **Home** - Dashboard with child overview
- **Children** - All linked children
- **Fees** - Fee management and payments
- **Messages** - School communications
- **More** - Settings and profile

### 3. Test Data
The components are designed to work with existing API data:
- Ensure parent has linked children in the system
- Ensure children have assessments, attendance, and fee data
- Messages are pre-populated with demo data (can be replaced with real API)

## File Organization

### Core Pages
```
pages/parent-portal/
├── ParentPortalHome.jsx       - Main dashboard (900 lines)
├── ParentPortalChildren.jsx   - Children cards view (280 lines)
├── ParentPortalFees.jsx       - Fee management (450 lines)
├── ParentPortalMessages.jsx   - Communication inbox (380 lines)
├── ParentPortalMore.jsx       - Settings & profile (300 lines)
└── Supplementary screens (Results, Attendance, Transport, Documents, Support)
```

### Configuration
```
dashboard/mobile/MobileNavigationConfig.ts
  - Updated PARENT navigation to use new pages
```

### Router Integration
```
layout/PageRouter.jsx
  - Added 10 new case statements for parent portal routes
```

## Component Architecture

### Home Screen (`ParentPortalHome.jsx`)
Main component with sub-components for different sections:

```jsx
ParentPortalHome (main)
├── LoadingCard (placeholder)
├── HeroChildCard (large child info card)
├── FeeSummaryCard (fee status)
├── AssessmentCard (subject scores)
├── AttendanceCard (attendance stats)
├── AnnouncementsCard (announcements)
└── QuickActionsBar (5 primary actions)
```

### Fees Screen (`ParentPortalFees.jsx`)
Banking app-style fees interface:

```jsx
ParentPortalFees (main)
├── OutstandingBalanceCard (hero card)
├── PaymentProgressCard (progress visualization)
├── FeeBreakdownCard (category breakdown)
├── RecentTransactionsCard (transaction list)
└── PaymentMethodsCard (payment options)
```

### Messages Screen (`ParentPortalMessages.jsx`)
Chat inbox with conversation management:

```jsx
ParentPortalMessages (main)
├── ConversationItem (conversation list item)
├── ChatWindow (message modal)
└── MessageBubble (individual message)
```

## Adding New Features

### Adding a New Section to Home Screen

1. Create a new sub-component in `ParentPortalHome.jsx`:
```jsx
function MyNewCard({ data, onAction }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      {/* Your content */}
    </div>
  );
}
```

2. Add it to the layout:
```jsx
<MyNewCard data={someData} onAction={handleAction} />
```

### Adding a New Page

1. Create the page component:
```jsx
// pages/parent-portal/ParentPortalNewPage.jsx
const ParentPortalNewPage = ({ user, onNavigate }) => {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Page content */}
    </div>
  );
};
```

2. Add to `PageRouter.jsx`:
```jsx
// Import
const ParentPortalNewPage = lazy(() => import('../pages/parent-portal/ParentPortalNewPage'));

// Case statement
case 'parent-portal-new':
  return <ParentPortalNewPage user={user} onNavigate={handleNavigate} />;
```

3. Update navigation if needed in `MobileNavigationConfig.ts`

### Adding a New Quick Action

Edit `QuickActionsBar` in `ParentPortalHome.jsx`:

```jsx
const actions = [
  { 
    id: 'my-action', 
    label: 'My Action',
    icon: MyIcon,
    action: () => onNavigate('parent-portal-my-page')
  },
  // ... other actions
];
```

## API Integration

### Current Data Sources

Most components fetch data from `dashboardAPI.getParentMetrics()`:

```javascript
const response = await dashboardAPI.getParentMetrics();
// Returns:
{
  success: true,
  data: {
    children: [...],        // Array of child objects
    stats: {...},          // Overall statistics
    messages: [...],       // Message list
    notices: [...],        // Announcements
    homework: [...],       // Homework items
    invoices: [...]        // Fee invoices
  }
}
```

### Adding New API Calls

1. Define the API method in your service:
```javascript
// In api.ts or services
export const dashboardAPI = {
  getParentMetrics: async () => { /* ... */ },
  getParentMessages: async () => { /* ... */ },
  myNewMethod: async () => { /* ... */ }
};
```

2. Use in component:
```jsx
const response = await dashboardAPI.myNewMethod();
if (response.success) {
  setData(response.data);
}
```

## Styling & Design System

### Color Classes
All colors use Tailwind with TrendSCORE brand colors:

```css
/* Primary */
bg-brand-purple           /* Main action color */
text-brand-purple
border-brand-purple

/* Status Colors */
bg-emerald-50/600/700     /* Success/Positive */
bg-amber-50/500/600       /* Warning */
bg-rose-50/600            /* Danger/Negative */
bg-blue-50/500/600        /* Information */
```

### Layout Classes
```css
rounded-2xl               /* Rounded corners */
border border-gray-200    /* Card borders */
shadow-md                 /* Soft shadows */
p-4/5/6                  /* Consistent padding */
gap-3/4                  /* Consistent spacing */
```

### Responsive
Mobile-first approach - all components are mobile optimized by default.

For desktop enhancements, add sm:, md:, lg: prefixes sparingly.

## Common Patterns

### Loading States
```jsx
{loading ? (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <div key={i} className="h-16 bg-white rounded-xl animate-pulse" />
    ))}
  </div>
) : (
  // Content
)}
```

### Empty States
```jsx
{items.length === 0 ? (
  <div className="text-center py-12">
    <Icon size={40} className="mx-auto mb-3 text-gray-300" />
    <h3 className="font-semibold text-gray-900 mb-1">No Items</h3>
    <p className="text-sm text-gray-500">Help text</p>
  </div>
) : (
  // Content
)}
```

### Modal/Dialog Pattern
```jsx
{showModal && (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center">
    <div className="bg-white rounded-2xl p-6 w-full sm:max-w-md">
      {/* Content */}
    </div>
  </div>
)}
```

## Performance Optimization

### Lazy Loading
All components are lazy-loaded except the main dashboard:
```javascript
const ParentPortalHome = lazy(() => import('...'));
```

### Memoization
For frequently rendered lists:
```jsx
const ConversationItem = memo(({ conversation, isSelected, onClick }) => (
  // Component
));
```

### API Caching
Cache API responses in state to avoid duplicate calls:
```jsx
const [cachedData, setCachedData] = useState(null);
useEffect(() => {
  if (!cachedData) {
    loadData();
  }
}, []);
```

## Debugging

### Console Logging
Components have strategic console.error logs for API failures:
```javascript
catch (error) {
  console.error('Failed to load metrics:', error);
}
```

### Visual Debugging
Use React DevTools to:
- Inspect component hierarchy
- Check props being passed
- Watch state changes

### Network Debugging
Use browser DevTools Network tab to:
- Monitor API calls
- Check response data
- Verify error handling

## Common Issues & Solutions

### Issue: Pages not appearing
**Solution**: 
1. Check PageRouter.jsx has the case statement
2. Verify component is exported default
3. Check navigation path matches case name

### Issue: Data not loading
**Solution**:
1. Check API method exists
2. Verify error handling logs
3. Check network tab for API calls

### Issue: Styling looks broken
**Solution**:
1. Verify Tailwind CSS is included
2. Check className strings are correct
3. Check for conflicting CSS

### Issue: Navigation not working
**Solution**:
1. Verify page name in onNavigate() matches case
2. Check MobileNavigationConfig has correct paths
3. Verify onNavigate handler is passed as prop

## Testing Checklist

- [ ] All pages load without errors
- [ ] Data displays correctly on home screen
- [ ] Child selector works and updates data
- [ ] Fee balance displays correctly
- [ ] Fees page shows breakdown and transactions
- [ ] Messages can be viewed and sent
- [ ] Settings can be toggled
- [ ] Navigation between pages works
- [ ] Logout works
- [ ] Responsive on mobile sizes
- [ ] API calls complete successfully
- [ ] Error states handled gracefully

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com)
- [Lucide Icons](https://lucide.dev)
- [React Documentation](https://react.dev)
- [Browser DevTools Docs](https://developer.chrome.com/docs/devtools/)

## Support

For questions or issues with the parent portal:
1. Check this guide first
2. Review component inline comments
3. Check console for error messages
4. Contact the development team
