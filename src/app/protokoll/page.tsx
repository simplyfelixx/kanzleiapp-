import StaticPage from "@/components/StaticPage";
import { css, html } from "@/designs/protokoll";

export const metadata = { title: "Protokoll – Kanzlei" };

export default function Page() {
  return <StaticPage css={css} html={html} kind="desk" />;
}
