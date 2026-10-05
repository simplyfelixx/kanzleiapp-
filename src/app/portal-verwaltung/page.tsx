import StaticPage from "@/components/StaticPage";
import { css, html } from "@/designs/portal_verwaltung";

export const metadata = { title: "Portal-Verwaltung – Kanzlei" };

export default function Page() {
  return <StaticPage css={css} html={html} kind="desk" />;
}
