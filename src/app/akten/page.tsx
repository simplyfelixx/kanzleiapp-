import StaticPage from "@/components/StaticPage";
import { css, html } from "@/designs/akten";

export const metadata = { title: "Akten – Kanzlei" };

export default function Page() {
  return <StaticPage css={css} html={html} kind="desk" />;
}
