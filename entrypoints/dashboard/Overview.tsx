import { formatDate } from '@/lib/format';
import { activityLevel, dailyActivity, heatmapWeeks, localDay, summarize } from '@/lib/stats';
import type { JobRecord } from '@/lib/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The numbers and the activity chart at the top of the Jobs tab.
export function Overview({ jobs }: { jobs: JobRecord[] }) {
  const now = new Date();
  const summary = summarize(jobs, now.getTime());
  const activity = dailyActivity(jobs);
  const weeks = heatmapWeeks(now);
  const mostCommon = summary.byAts[0]?.[1] ?? 1;

  return (
    <>
      <section className="cards">
        <Card label="Jobs recorded" value={summary.total} />
        <Card label="Applied" value={summary.applied} />
        <Card label="Applied in the last 7 days" value={summary.appliedLast7Days} />
        <Card label="Applied out of recorded" value={`${Math.round(summary.conversion * 100)}%`} />
      </section>

      <section>
        <h2>Applications per day</h2>
        <div className="heatmap" role="img" aria-label="Applications per day over the last year">
          {weeks.map((week, index) => {
            // Label a column with the month when a month starts in it.
            const first = week.find((day) => day !== null);
            const previous = weeks[index - 1]?.find((day) => day !== null);
            const month = first && first.getMonth() !== previous?.getMonth() ? MONTHS[first.getMonth()] : '';
            return (
              <div className="week" key={index}>
                <span className="month">{month}</span>
                {week.map((day, weekday) => {
                  if (!day) return <span className="day blank" key={weekday} />;
                  const { applied, viewed } = activity.get(localDay(day)) ?? { applied: 0, viewed: 0 };
                  return (
                    <span
                      className={`day level-${activityLevel(applied)}`}
                      key={weekday}
                      title={`${formatDate(day)}: ${applied} applied, ${viewed} first viewed`}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
        <p className="legend">
          Less
          {[0, 1, 2, 3, 4].map((level) => (
            <span className={`day level-${level}`} key={level} />
          ))}
          More
        </p>
      </section>

      <div className="columns">
        <section>
          <h2>By site</h2>
          {summary.byAts.length === 0 && <p className="hint">Nothing yet.</p>}
          {summary.byAts.map(([name, count]) => (
            <div className="bar-row" key={name}>
              <span>{name}</span>
              <span className="bar-track">
                <span className="bar" style={{ width: `${(count / mostCommon) * 100}%` }} />
              </span>
              <span className="count">{count}</span>
            </div>
          ))}
        </section>
        <section>
          <h2>Jobs with warnings</h2>
          {summary.byFlag.length === 0 && <p className="hint">None.</p>}
          {summary.byFlag.map(([name, count]) => (
            <div className="bar-row" key={name}>
              <span className="tag">{name}</span>
              <span />
              <span className="count">{count}</span>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

function Card({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
