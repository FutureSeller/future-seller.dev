import React from 'react'
import Helmet from 'react-helmet'
import { useStaticQuery, graphql } from 'gatsby'

interface Props {
  description?: string
  lang?: string
  path?: string
  title?: string
}

const SEO = ({ description, lang = 'ko', path, title }: Props) => {
  const { site } = useStaticQuery(
    graphql`
      query {
        site {
          siteMetadata {
            title
            siteUrl
            description
          }
        }
      }
    `
  )

  const metaDescription = description || site.siteMetadata.description
  const defaultTitle = site.siteMetadata?.title
  const siteUrl = site.siteMetadata?.siteUrl

  const metaTags = [
    {
      name: `description`,
      content: metaDescription,
    },
    {
      property: 'og:site_name',
      content: 'future-seller.dev',
    },
    {
      property: 'og:locale',
      content: 'ko_KR',
    },
    {
      property: 'og:type',
      content: 'article',
    },
    {
      property: `og:title`,
      content: title,
    },
    {
      property: `og:description`,
      content: metaDescription,
    },
    {
      property: 'og:url',
      content: path ? `${siteUrl}${path}` : siteUrl,
    },
    {
      name: `twitter:card`,
      content: `summary`,
    },
    {
      name: `twitter:title`,
      content: title,
    },
    {
      name: `twitter:description`,
      content: metaDescription,
    },
    {
      name: 'twitter:url',
      content: path ? `${siteUrl}${path}` : siteUrl,
    },
  ]

  return (
    <Helmet
      htmlAttributes={{
        lang,
      }}
      title={title || defaultTitle}
      titleTemplate={defaultTitle !== title ? `%s | ${defaultTitle}` : undefined}
      meta={metaTags}
    />
  )
}

export default SEO
