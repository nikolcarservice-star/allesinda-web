import { ProfileLayoutWrapper } from "./profile-layout-wrapper"

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <ProfileLayoutWrapper>{children}</ProfileLayoutWrapper>
}
