import './post-template.css'

import React from 'react'
import Helmet from 'react-helmet'
import { graphql } from 'gatsby'
import type { PageProps } from 'gatsby'

import Layout from '../components/Layout'

const PostTemplate = ({ data }: PageProps<Queries.PostBySlugQuery>) => {
  const { title } = data.site?.siteMetadata!
  const post = data.markdownRemark
  const { title: postTitle, description: postDescription } = post?.frontmatter!
  const description = postDescription !== null ? postDescription : title

  return (
    <main>
      <Helmet>
        <title>{`${postTitle} - ${title}`}</title>
        <meta name="description" content={description} />
      </Helmet>
      <Layout>
        <article>
          <h1 className="text-3xl font-bold mt-4 mb-8">{postTitle}</h1>
          <section
            className="post-content"
            /* eslint-disable-next-line react/no-danger */
            dangerouslySetInnerHTML={{ __html: post?.html! }}
          />
        </article>
      </Layout>
    </main>
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
