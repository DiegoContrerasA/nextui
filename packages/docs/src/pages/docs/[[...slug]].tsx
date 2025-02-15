/* eslint-disable react/display-name */
import * as React from 'react';
import { useRouter } from 'next/router';
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote';
import DocsLayout from '@layouts/docs';
import * as Components from '@nextui-org/react';
import { GetStaticProps, GetStaticPaths } from 'next';
import { MetaProps } from '@lib/docs/meta';
import useDocsRoute from '@hooks/use-docs-route';
import { MDXComponents } from '@components';
import matter from 'gray-matter';
import { serialize } from 'next-mdx-remote/serialize';
import { getSlug } from '@lib/docs/utils';
import fs from 'fs';
import path from 'path';
import {
  Route,
  getCurrentTag,
  fetchDocsManifest,
  fetchRawDoc,
  findRouteByPath,
  getRawAsset,
  getPaths,
} from '@lib/docs/page';
import { isProd } from '@utils/index';

const components = {
  ...Components,
  ...MDXComponents,
};

interface Props {
  routes: Route[];
  currentRoute?: Route;
  source?: MDXRemoteSerializeResult;
  meta?: MetaProps;
}

const DocsPage: React.FC<Props> = ({ routes, currentRoute, source, meta }) => {
  const { route, prevRoute, nextRoute } = useDocsRoute(routes, currentRoute);
  const { query } = useRouter();
  const { tag, slug } = getSlug(query);
  return (
    <DocsLayout
      routes={routes}
      currentRoute={route}
      prevRoute={prevRoute}
      nextRoute={nextRoute}
      tag={tag}
      slug={slug}
      meta={meta}
    >
      {source && <MDXRemote {...source} components={components} />}
    </DocsLayout>
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  const tag = await getCurrentTag();
  const manifest = await fetchDocsManifest(tag);
  const paths = getPaths(manifest.routes);
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const { tag, slug } = getSlug(params);
  const currentTag = await getCurrentTag(tag);
  const manifest = await fetchDocsManifest(currentTag).catch((error) => {
    // If a manifest wasn't found for a custom tag, show a 404 instead
    if (error.status === 404) return;
    throw error;
  });

  const route = manifest && findRouteByPath(slug, manifest.routes);

  if (!route) {
    return {
      props: {},
    };
  }

  let meta, doc;

  if (isProd) {
    const rawFileSource = await fetchRawDoc(route.path, currentTag);
    const { content, data } = matter(rawFileSource);
    doc = content.toString();
    meta = data;
  } else {
    meta = null;
    const folderPath = path.join(process.cwd(), 'content');
    const filePath = path.join(folderPath, `${slug}.mdx`);
    const rawFileSource = fs.readFileSync(filePath);
    const { content, data } = matter(rawFileSource);
    doc = content.toString();
    meta = data;
  }
  const mdxSource = await serialize(doc, {
    mdxOptions: {
      remarkPlugins: [
        require('remark-autolink-headings'),
        require('remark-slug'),
      ],
      rehypePlugins: [require('@mapbox/rehype-prism')],
    },
  });

  const routes = manifest.routes.map((route: any) => {
    if (route.icon) {
      return {
        ...route,
        icon: getRawAsset(route.icon, currentTag),
      };
    }
    return route;
  });

  return {
    props: {
      routes,
      meta,
      source: mdxSource,
      currentRoute: route,
    },
  };
};

export default DocsPage;
