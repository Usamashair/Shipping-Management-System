<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use PDO;
use PDOException;

class CreateDatabaseCommand extends Command
{
    protected $signature = 'db:create {--charset=utf8mb4} {--collation=utf8mb4_unicode_ci}';

    protected $description = 'Create the MySQL database from DB_* config if it does not exist (mysql driver only)';

    public function handle(): int
    {
        if (config('database.default') !== 'mysql') {
            $this->components->info('Skipped: database.default is not mysql.');

            return self::SUCCESS;
        }

        $database = (string) config('database.connections.mysql.database');
        if ($database === '') {
            $this->components->error('DB_DATABASE is empty.');

            return self::FAILURE;
        }

        $host = (string) config('database.connections.mysql.host');
        $port = (int) config('database.connections.mysql.port', 3306);
        $username = (string) config('database.connections.mysql.username');
        $password = (string) config('database.connections.mysql.password');

        $charset = $this->sanitizeIdentifier((string) $this->option('charset'), 'utf8mb4');
        $collation = $this->sanitizeIdentifier((string) $this->option('collation'), 'utf8mb4_unicode_ci');

        $dsn = sprintf('mysql:host=%s;port=%d;charset=%s', $host, $port, $charset);

        try {
            $pdo = new PDO($dsn, $username, $password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
        } catch (PDOException $e) {
            $this->components->error('Could not connect to MySQL server: '.$e->getMessage());

            return self::FAILURE;
        }

        $safeName = str_replace('`', '``', $database);
        $sql = sprintf(
            'CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET %s COLLATE %s',
            $safeName,
            $charset,
            $collation,
        );

        try {
            $pdo->exec($sql);
        } catch (PDOException $e) {
            $this->components->error('Could not create database: '.$e->getMessage());

            return self::FAILURE;
        }

        $this->components->info("Database `{$database}` is ready.");

        return self::SUCCESS;
    }

    private function sanitizeIdentifier(string $value, string $fallback): string
    {
        if (preg_match('/^[A-Za-z0-9_]+$/', $value) === 1) {
            return $value;
        }

        return $fallback;
    }
}
