interface HeaderProps {
  title?: string;
  children?: React.ReactNode;
}

export function Header({ title, children }: HeaderProps) {
  return (
    <div className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-8">
      {title && (
        <h1 className="text-base font-semibold text-gray-900">{title}</h1>
      )}
      {!title && <div />}
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}
