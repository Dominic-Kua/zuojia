import React, { useState } from 'react'

export default function Manuscript(){
  const [text, setText] = useState('<h1>Chapter 1 — The Quiet House</h1><p>Start writing here…</p>')

  return (
    <div className="manuscript-inner">
      <div className="manuscript-meta">
        <select className="chapter-select"><option>Chapter 1</option><option>Chapter 2</option></select>
        <div className="wordcounts">
          <span>Manuscript: 78,342</span>
          <span>Open chapter: 4,213</span>
          <span>Today: 1,257</span>
        </div>
      </div>
      <article className="editor" contentEditable onInput={e=>setText(e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{__html:text}} />
    </div>
  )
}
