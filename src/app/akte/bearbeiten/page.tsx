import StaticPage from "@/components/StaticPage";
import { css, html } from "@/designs/akte_bearbeiten";

export const metadata = { title: "Bearbeiten – Kanzlei" };

export default function Page() {
  return <StaticPage css={css} html={html} kind="desk" />;
}
