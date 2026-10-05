import StaticPage from "@/components/StaticPage";
import { css, html } from "@/designs/mail";

export const metadata = { title: "Mail – Kanzlei" };

export default function Page() {
  return <StaticPage css={css} html={html} kind="desk" />;
}
