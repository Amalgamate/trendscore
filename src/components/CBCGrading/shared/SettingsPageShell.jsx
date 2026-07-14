import React from 'react';
import PageHeader from './PageHeader';

const WIDTHS = {
  wide: 'max-w-6xl',
  standard: 'max-w-5xl',
  focused: 'max-w-4xl',
};

/**
 * Shared page composition for settings workspaces.
 * The app shell owns page gutters/background; this component owns a consistent
 * readable content width, header, spacing and panel rhythm.
 */
const SettingsPageShell = ({
  title,
  description,
  icon,
  actions,
  width = 'wide',
  children,
  className = '',
}) => (
  <div className={`mx-auto w-full ${WIDTHS[width] || WIDTHS.wide} space-y-6 pb-12 ${className}`}>
    {title && (
      <PageHeader
        title={title}
        subtitle={description}
        icon={icon}
        actions={actions}
        className="mb-0"
      />
    )}
    {children}
  </div>
);

export default SettingsPageShell;
