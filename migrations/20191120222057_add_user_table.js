
exports.up = function(knex) {
    return knex.schema.createTable('users', function(table) {
        table.increments('id').primary();
        table.timestamps(true, true);
        table.string('email', 255).unique().notNullable().index();
        table.string('password', 255);
        table.boolean('verified').defaultTo(false).notNullable();
        table.boolean('active').defaultTo(true).notNullable();
        table.string('name', 32).unique().notNullable();
    });
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists('users');
};
