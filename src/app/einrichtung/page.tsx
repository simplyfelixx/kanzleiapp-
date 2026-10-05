import StaticPage from "@/components/StaticPage";
import { css, html } from "@/designs/einrichtung";

export const metadata = { title: "Einrichtung – Kanzlei" };

export default function Page() {
  return <StaticPage css={css} html={html} kind="bare" />;
}
