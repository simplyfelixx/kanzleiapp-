import StaticPage from "@/components/StaticPage";
import { css, html } from "@/designs/fallaufnahme";

export const metadata = { title: "Fallaufnahme – Kanzlei" };

export default function Page() {
  return <StaticPage css={css} html={html} kind="desk" />;
}
