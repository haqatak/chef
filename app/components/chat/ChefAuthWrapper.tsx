export const ChefAuthProvider = ({
  children,
  redirectIfUnauthenticated,
}: {
  children: React.ReactNode;
  redirectIfUnauthenticated: boolean;
}) => {
  // For now, we're running without external auth
  // The session is initialized in UserProvider
  return <>{children}</>;
};
