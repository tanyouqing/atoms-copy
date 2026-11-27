"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api-client";

/** 创建项目并跳转到工作台（?start=1 自动开始首次生成）。 */
export function useCreateProject() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const create = async (prompt: string) => {
    if (pending) return;
    setPending(true);
    try {
      const { project } = await api.createProject(prompt);
      router.push(`/p/${project.id}?start=1`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "创建失败，请重试");
      setPending(false);
    }
  };
  return { create, pending };
}
