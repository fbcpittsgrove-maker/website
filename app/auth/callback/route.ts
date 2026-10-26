import { handleEmailLink } from "@/lib/auth/email-link";

export async function GET(request: Request) {
  return handleEmailLink(request as never);
}
