import type { Project } from '../data/projects'

export function Card({ p }: { p: Project }) {
  return (
    <div className="card">
      <span className="tag">{p.tag}</span>
      <h3>{p.title}</h3>
      <p>{p.body}</p>
      <div className="card-foot">
        <span className="pills">{p.pills.map((x) => <span key={x} className="pill">{x}</span>)}</span>
        <span className="links">
          {p.links.map((l, i) =>
            'soon' in l ? <span key={i} className="soon">{l.soon}</span>
                        : <a key={i} href={l.href}>{l.text}</a>)}
        </span>
      </div>
    </div>
  )
}
