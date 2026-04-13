import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- SUPABASE_URL or VITE_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface GraphWithDomain {
  id: string;
  user_id: string;
  title: string;
  domain: string | null;
}

interface DomainRecord {
  id: string;
  name: string;
  user_id: string | null;
}

async function migrateGraphDomains() {
  console.log('Starting graph domain migration...');
  console.log('='.repeat(50));

  const { data: graphsWithDomain, error: graphsError } = await supabase
    .from('knowledge_graphs')
    .select('id, user_id, title, domain')
    .not('domain', 'is', null)
    .is('deleted_at', null);

  if (graphsError) {
    console.error('Error fetching graphs:', graphsError);
    process.exit(1);
  }

  if (!graphsWithDomain || graphsWithDomain.length === 0) {
    console.log('No graphs with domain field found. Nothing to migrate.');
    return;
  }

  console.log(`Found ${graphsWithDomain.length} graphs with domain field.`);

  const { data: existingAssociations, error: assocError } = await supabase
    .from('graph_domains')
    .select('graph_id');

  if (assocError) {
    console.error('Error fetching existing associations:', assocError);
    process.exit(1);
  }

  const associatedGraphIds = new Set(
    (existingAssociations || []).map((a) => a.graph_id)
  );

  const graphsWithoutAssociation = graphsWithDomain.filter(
    (g) => !associatedGraphIds.has(g.id)
  );

  if (graphsWithoutAssociation.length === 0) {
    console.log('All graphs already have domain associations. Nothing to migrate.');
    return;
  }

  console.log(
    `Found ${graphsWithoutAssociation.length} graphs needing domain association.`
  );

  const domainCache = new Map<string, DomainRecord>();

  let successCount = 0;
  let errorCount = 0;
  let domainCreatedCount = 0;

  for (const graph of graphsWithoutAssociation) {
    try {
      const cacheKey = `${graph.domain}:${graph.user_id}`;
      let domainRecord = domainCache.get(cacheKey);

      if (!domainRecord) {
        const { data: existingDomain, error: domainError } = await supabase
          .from('domains')
          .select('id, name, user_id')
          .eq('name', graph.domain!)
          .eq('user_id', graph.user_id)
          .maybeSingle();

        if (domainError) {
          console.error(
            `Error querying domain "${graph.domain}" for graph "${graph.title}":`,
            domainError
          );
          errorCount++;
          continue;
        }

        if (existingDomain) {
          domainRecord = existingDomain;
          domainCache.set(cacheKey, domainRecord);
        } else {
          const { data: newDomain, error: createError } = await supabase
            .from('domains')
            .insert({
              name: graph.domain!,
              user_id: graph.user_id,
              color: '#6366F1',
            })
            .select('id, name, user_id')
            .single();

          if (createError || !newDomain) {
            console.error(
              `Error creating domain "${graph.domain}" for graph "${graph.title}":`,
              createError
            );
            errorCount++;
            continue;
          }

          domainRecord = newDomain;
          domainCache.set(cacheKey, domainRecord);
          domainCreatedCount++;
          console.log(`Created new domain: "${graph.domain}" (${newDomain.id})`);
        }
      }

      const { error: insertError } = await supabase.from('graph_domains').insert({
        graph_id: graph.id,
        domain_id: domainRecord.id,
        is_primary: true,
      });

      if (insertError) {
        if (insertError.code === '23505') {
          console.log(
            `Association already exists for graph "${graph.title}" (${graph.id}), skipping.`
          );
        } else {
          console.error(
            `Error creating association for graph "${graph.title}":`,
            insertError
          );
          errorCount++;
        }
        continue;
      }

      successCount++;
      console.log(
        `✓ Migrated: "${graph.title}" -> "${graph.domain}" (${domainRecord.id})`
      );
    } catch (err) {
      console.error(`Unexpected error for graph "${graph.title}":`, err);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Migration Summary:');
  console.log(`  Total graphs processed: ${graphsWithoutAssociation.length}`);
  console.log(`  Successful migrations: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  New domains created: ${domainCreatedCount}`);
  console.log('='.repeat(50));

  if (errorCount > 0) {
    process.exit(1);
  }
}

migrateGraphDomains()
  .then(() => {
    console.log('\nMigration completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
