import StaticPage from "@/components/StaticPage";
import { css, html } from "@/designs/fristen";

export const metadata = { title: "Fristen – Kanzlei" };

export default function Page() {
  return <StaticPage css={css} html={html} kind="desk" />;
}
