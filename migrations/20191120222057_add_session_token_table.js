
exports.up = function(knex) {
    return knex.schema.createTable('session_tokens', function(table) {
        table.string('id', 32).primary();
        table.timestamps(true, true);
        table.integer('user_id').unsigned().notNullable();
        table.foreign('user_id').references('users.id');
        table.boolean('active').defaultTo(true);
    });
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists('session_tokens');
};
