
exports.up = function(knex) {
    return knex.schema.createTable('api_keys', function(table) {
        table.string('id', 128).primary();
        table.timestamps(true, true);
        table.boolean('active').defaultTo(true);
    });
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists('api_keys');
};
