import React from "react";

/**
 * Section frame. The console shell already shows the section's code, title
 * and one-line description, so this only renders what's specific to the
 * page: its actions and toolbar. `title`/`description` stay in the props for
 * screen readers and for anyone rendering a section outside the shell.
 */
const AdminPage: React.FC<
  React.PropsWithChildren<{ eyebrow?: string; title: string; description: string; actions?: React.ReactNode; toolbar?: React.ReactNode }>
> = ({ title, actions, toolbar, children }) => (
  <div className="space-y-4">
    <h2 className="sr-only">{title}</h2>
    {(actions || toolbar) && (
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {toolbar && <div className="min-w-0 flex-1">{toolbar}</div>}
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
    )}
    {children}
  </div>
);

export default AdminPage;
