import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/profile";
import { getPost } from "@/lib/posts-server";
import { PostEditor } from "./post-editor";

export const metadata = { title: "Review post" };

export default async function AdminPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const post = await getPost(id);
  if (!post) notFound();
  return <PostEditor post={post} />;
}
