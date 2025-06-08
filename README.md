# OpenShift Route Certificate Checker

A CLI tool to check OpenShift routes and validate their TLS certificates.

## Installation

```bash
npm install
```

## Usage

```bash
# Basic usage
npm start -- --token YOUR_K8S_TOKEN --namespaces "namespace1,namespace2"

# With custom server
npm start -- --token YOUR_K8S_TOKEN --namespaces "namespace1,namespace2" --server https://api.cluster.example.com:6443

# Table output format
npm start -- --token YOUR_K8S_TOKEN --namespaces "namespace1,namespace2" --output table
```

## Options

- `-t, --token <token>`: Kubernetes API token (required)
- `-n, --namespaces <namespaces>`: Comma-separated list of namespaces (required)
- `-s, --server <server>`: Kubernetes API server URL (default: https://kubernetes.default.svc)
- `-o, --output <format>`: Output format - json or table (default: json)

## Features

- Retrieves all routes from specified namespaces
- Parses TLS certificates and extracts information
- Validates if route host matches certificate subject/SAN
- Checks if private key matches certificate
- Shows certificate validity dates and other details
