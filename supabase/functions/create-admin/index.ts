// 관리자(로그인 가능한 사람)를 추가하는 서버 함수.
// service_role 키는 여기(서버)에서만 쓰고 클라이언트 코드에는 절대 두지 않음.
// 주의: 대시보드의 "Verify JWT" 설정은 anon key만 보내도 통과한다(실제 로그인 여부를 보장하지 않음).
// 그래서 로그인 여부는 아래에서 getUser()로 직접 한 번 더 확인함 — 이걸 빼면 공개 anon key를
// 아는 아무나(이 저장소는 공개라 누구나 볼 수 있음) 이 함수를 불러 관리자를 만들 수 있게 됨.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await caller.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "로그인한 사용자만 관리자를 추가할 수 있습니다" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password } = await req.json();
    if (!email || !password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "이메일과 6자 이상 비밀번호를 입력하세요" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
