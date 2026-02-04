import MainLayoutClient from "./MainLayoutClient";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MainLayoutClient user={null} notifications={[]}>
      {children}
    </MainLayoutClient>
  );
}
