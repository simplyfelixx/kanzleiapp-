import StaticPage from "@/components/StaticPage";
import { css, html } from "@/designs/mandantenportal";

export const metadata = { title: "Mandantenportal – Kanzlei" };

export default function Page() {
  return <StaticPage css={css} html={html} kind="phone" />;
}
