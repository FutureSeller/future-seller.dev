import React from 'react'
import { Link } from 'gatsby'

const Post = ({ node }: Queries.IndexPageQuery['allMarkdownRemark']['edges'][number]) => {
  return (
    <article className="mb-14 last:mb-4 hover:underline">
      <Link className="block" to={`/posts/${node.fields.slug}`}>
        <h2 className="text-2xl font-bold mb-4">{node.frontmatter.title}</h2>
        <p className="mb-3">{node.frontmatter.description}</p>
      </Link>
    </article>
  )
}

export default Post
