import { Clock3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { GridfinityAppAccent } from "./types";
import styles from "./app-upcoming.module.css";

type AppUpcomingProps = {
  accent: GridfinityAppAccent;
  description: string;
  icon: LucideIcon;
  name: string;
};

export function AppUpcoming({
  accent,
  description,
  icon: Icon,
  name,
}: AppUpcomingProps) {
  return (
    <section className={styles.upcoming} data-accent={accent}>
      <div className={styles.content}>
        <div className={styles.iconWrap}>
          <Icon aria-hidden="true" size={54} />
        </div>
        <p className={styles.kicker}>
          <Clock3 aria-hidden="true" size={15} />
          Coming soon
        </p>
        <h2>{name}</h2>
        <p>{description}</p>
        <div className={styles.stubBar} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  );
}
