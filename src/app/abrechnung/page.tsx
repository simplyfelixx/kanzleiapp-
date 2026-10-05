import StaticPage from "@/components/StaticPage";
import { css, html } from "@/designs/abrechnung";

export const metadata = { title: "Abrechnung – Kanzlei" };

export default function Page() {
  return <StaticPage css={css} html={html} kind="desk" />;
}
