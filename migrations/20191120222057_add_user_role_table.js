
exports.up = function(knex) {
    return knex.schema
        .createTable('user_roles', function(table) {
            table.increments('id').primary();
            table.timestamps(true, true);
            table.string('code', 32).unique().notNullable();
            table.string('name', 32).unique().notNullable();
        })
        .createTable('user_role_members', function(table) {
            table.timestamps(true, true);
            table.integer('user_id').unsigned().notNullable();
            table.foreign('user_id').references('users.id');
            table.integer('user_role_id').unsigned().notNullable();
            table.foreign('user_role_id').references('user_roles.id');
            table.primary(['user_id', 'user_role_id']);
        }).then(() => {
            return knex
                .from('user_roles')
                .insert([
                    {
                        code: 'admin',
                        name: 'Admin'
                    },
                    {
                        code: 'writer',
                        name: 'Writer'
                    }
                ]);
        });
};

exports.down = function(knex) {
    return knex.schema
        .dropTableIfExists('user_role_members')
        .dropTableIfExists('user_roles');
};
