import StaticPage from "@/components/StaticPage";
import { css, html } from "@/designs/vorlagen";

export const metadata = { title: "Vorlagen – Kanzlei" };

export default function Page() {
  return <StaticPage css={css} html={html} kind="desk" />;
}
