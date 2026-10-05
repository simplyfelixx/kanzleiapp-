import StaticPage from "@/components/StaticPage";
import { css, html } from "@/designs/adressbuch";

export const metadata = { title: "Adressbuch – Kanzlei" };

export default function Page() {
  return <StaticPage css={css} html={html} kind="desk" />;
}
