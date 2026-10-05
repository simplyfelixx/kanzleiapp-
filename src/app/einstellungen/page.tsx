import StaticPage from "@/components/StaticPage";
import { css, html } from "@/designs/einstellungen";

export const metadata = { title: "Einstellungen – Kanzlei" };

export default function Page() {
  return <StaticPage css={css} html={html} kind="desk" />;
}
