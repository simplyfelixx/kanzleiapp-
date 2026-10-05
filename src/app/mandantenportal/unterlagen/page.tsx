import StaticPage from "@/components/StaticPage";
import { css, html } from "@/designs/mandantenportal_unterlagen";

export const metadata = { title: "Mandantenportal – Kanzlei" };

export default function Page() {
  return <StaticPage css={css} html={html} kind="phone" />;
}
