import StaticPage from "@/components/StaticPage";
import { css, html } from "@/designs/auswertungen";

export const metadata = { title: "Auswertungen – Kanzlei" };

export default function Page() {
  return <StaticPage css={css} html={html} kind="desk" />;
}
