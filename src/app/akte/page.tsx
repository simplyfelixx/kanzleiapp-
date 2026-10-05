import StaticPage from "@/components/StaticPage";
import { css, html } from "@/designs/akte";

export const metadata = { title: "Akte – Kanzlei" };

export default function Page() {
  return <StaticPage css={css} html={html} kind="desk" />;
}
