import React from 'react'
import Helmet from 'react-helmet'
import { graphql, PageProps } from 'gatsby'

const PostTemplate = ({ data }: PageProps<Queries.PostBySlugQuery>) => {
  const { title } = data.site?.siteMetadata!
  const post = data.markdownRemark
  const { title: postTitle, description: postDescription } = post?.frontmatter!
  const description = postDescription !== null ? postDescription : title

  return (
    <div>
      <Helmet>
        <title>{`${postTitle} - ${title}`}</title>
        <meta name="description" content={description} />
      </Helmet>
      <div
        className="post-single__body"
        /* eslint-disable-next-line react/no-danger */
        dangerouslySetInnerHTML={{ __html: post?.html! }}
      />
    </div>
  )
}

export default PostTemplate

export const pageQuery = graphql`
  query PostBySlug($slug: String!) {
    site {
      siteMetadata {
        description
        siteUrl
        title
      }
    }
    markdownRemark(fields: { slug: { eq: $slug } }) {
      id
      html
      fields {
        slug
      }
      frontmatter {
        date
        description
        title
      }
    }
  }
`
