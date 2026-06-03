import type { User } from "@/lib/api/types"

/** Where to land after a successful login, by role. */
export function getPostLoginPath(user: User): string {
  switch (user.role) {
    case "master":
      return "/dashboard/master"
    case "seller":
      return "/dashboard/seller"
    case "admin":
      return "/admin"
    default:
      return "/profile"
  }
}
