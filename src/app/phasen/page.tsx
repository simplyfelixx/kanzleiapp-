import StaticPage from "@/components/StaticPage";
import { css, html } from "@/designs/phasen";

export const metadata = { title: "Phasen – Kanzlei" };

export default function Page() {
  return <StaticPage css={css} html={html} kind="desk" />;
}
