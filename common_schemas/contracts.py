"""
OpenAPI schema generation and contracts
"""

import json
from typing import Dict, Any, List, Optional, Type
from pathlib import Path
from pydantic import BaseModel
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
import yaml

def generate_openapi_spec(
    app: FastAPI,
    service_name: str,
    version: str = "1.0.0",
    output_dir: str = "/tmp/openapi"
) -> Dict[str, str]:
    """Generate OpenAPI specification for FastAPI app"""
    
    # Generate OpenAPI schema
    openapi_schema = get_openapi(
        title=f"{service_name} API",
        version=version,
        description=f"API for {service_name} analytics service",
        routes=app.routes,
    )
    
    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Save as JSON
    json_file = output_path / f"{service_name}-openapi.json"
    with open(json_file, 'w') as f:
        json.dump(openapi_schema, f, indent=2)
    
    # Save as YAML
    yaml_file = output_path / f"{service_name}-openapi.yaml"
    with open(yaml_file, 'w') as f:
        yaml.dump(openapi_schema, f, default_flow_style=False)
    
    return {
        'json': str(json_file),
        'yaml': str(yaml_file),
        'schema': openapi_schema
    }


def extract_typescript_types(openapi_schema: Dict[str, Any]) -> str:
    """Extract TypeScript types from OpenAPI schema"""
    
    typescript_code = []
    typescript_code.append("// Auto-generated TypeScript types")
    typescript_code.append("// Do not edit manually")
    typescript_code.append("")
    
    # Extract components/schemas
    components = openapi_schema.get('components', {})
    schemas = components.get('schemas', {})
    
    for schema_name, schema_def in schemas.items():
        ts_interface = _convert_schema_to_typescript(schema_name, schema_def)
        typescript_code.append(ts_interface)
        typescript_code.append("")
    
    # Extract API endpoints
    paths = openapi_schema.get('paths', {})
    api_methods = _extract_api_methods(paths)
    typescript_code.extend(api_methods)
    
    return "\n".join(typescript_code)


def _convert_schema_to_typescript(name: str, schema: Dict[str, Any]) -> str:
    """Convert OpenAPI schema to TypeScript interface"""
    
    lines = [f"export interface {name} {{"]
    
    properties = schema.get('properties', {})
    required = schema.get('required', [])
    
    for prop_name, prop_def in properties.items():
        prop_type = _get_typescript_type(prop_def)
        optional = "" if prop_name in required else "?"
        description = prop_def.get('description', '')
        
        if description:
            lines.append(f"  /** {description} */")
        
        lines.append(f"  {prop_name}{optional}: {prop_type};")
    
    lines.append("}")
    
    return "\n".join(lines)


def _get_typescript_type(prop_def: Dict[str, Any]) -> str:
    """Convert OpenAPI property to TypeScript type"""
    
    prop_type = prop_def.get('type', 'any')
    prop_format = prop_def.get('format')
    
    if prop_type == 'string':
        if prop_format in ['date', 'date-time']:
            return 'string'  # or Date if you prefer
        return 'string'
    elif prop_type == 'integer':
        return 'number'
    elif prop_type == 'number':
        return 'number'
    elif prop_type == 'boolean':
        return 'boolean'
    elif prop_type == 'array':
        items = prop_def.get('items', {})
        item_type = _get_typescript_type(items)
        return f"{item_type}[]"
    elif prop_type == 'object':
        # Handle nested objects
        if 'properties' in prop_def:
            # Inline object definition
            props = []
            for key, value in prop_def['properties'].items():
                prop_type = _get_typescript_type(value)
                props.append(f"{key}: {prop_type}")
            return f"{{ {'; '.join(props)} }}"
        return 'Record<string, any>'
    elif '$ref' in prop_def:
        # Reference to another schema
        ref = prop_def['$ref']
        return ref.split('/')[-1]  # Extract schema name
    else:
        return 'any'


def _extract_api_methods(paths: Dict[str, Any]) -> List[str]:
    """Extract API methods as TypeScript functions"""
    
    methods = []
    methods.append("// API Client Methods")
    methods.append("export class ApiClient {")
    methods.append("  constructor(private baseUrl: string, private apiKey?: string) {}")
    methods.append("")
    
    for path, path_def in paths.items():
        for method, method_def in path_def.items():
            if method.upper() in ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']:
                method_code = _generate_api_method(path, method, method_def)
                methods.append(method_code)
                methods.append("")
    
    methods.append("}")
    
    return methods


def _generate_api_method(path: str, method: str, method_def: Dict[str, Any]) -> str:
    """Generate TypeScript method for API endpoint"""
    
    operation_id = method_def.get('operationId', f"{method}_{path.replace('/', '_').replace('{', '').replace('}', '')}")
    summary = method_def.get('summary', '')
    
    # Extract parameters
    parameters = method_def.get('parameters', [])
    path_params = [p for p in parameters if p.get('in') == 'path']
    query_params = [p for p in parameters if p.get('in') == 'query']
    
    # Extract request body
    request_body = method_def.get('requestBody', {})
    body_schema = None
    if request_body:
        content = request_body.get('content', {})
        json_content = content.get('application/json', {})
        if json_content:
            body_schema = json_content.get('schema', {})
    
    # Extract response
    responses = method_def.get('responses', {})
    success_response = responses.get('200', responses.get('201', {}))
    response_schema = None
    if success_response:
        content = success_response.get('content', {})
        json_content = content.get('application/json', {})
        if json_content:
            response_schema = json_content.get('schema', {})
    
    # Build method signature
    method_name = operation_id.replace('-', '_').replace(' ', '_')
    params = []
    
    # Add path parameters
    for param in path_params:
        param_name = param['name']
        param_type = _get_typescript_type(param.get('schema', {}))
        params.append(f"{param_name}: {param_type}")
    
    # Add body parameter
    if body_schema:
        body_type = _get_typescript_type(body_schema)
        params.append(f"body: {body_type}")
    
    # Add query parameters as optional object
    if query_params:
        query_props = []
        for param in query_params:
            param_name = param['name']
            param_type = _get_typescript_type(param.get('schema', {}))
            optional = "" if param.get('required') else "?"
            query_props.append(f"{param_name}{optional}: {param_type}")
        
        query_type = f"{{ {'; '.join(query_props)} }}"
        params.append(f"params?: {query_type}")
    
    # Return type
    return_type = "Promise<any>"
    if response_schema:
        response_type = _get_typescript_type(response_schema)
        return_type = f"Promise<{response_type}>"
    
    # Build method
    lines = []
    if summary:
        lines.append(f"  /** {summary} */")
    
    lines.append(f"  async {method_name}({', '.join(params)}): {return_type} {{")
    
    # Build URL
    url_path = path
    for param in path_params:
        param_name = param['name']
        url_path = url_path.replace(f"{{{param_name}}}", f"${{{param_name}}}")
    
    lines.append(f"    const url = `${{this.baseUrl}}{url_path}`;")
    
    # Build fetch options
    lines.append("    const options: RequestInit = {")
    lines.append(f"      method: '{method.upper()}',")
    lines.append("      headers: {")
    lines.append("        'Content-Type': 'application/json',")
    lines.append("        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),")
    lines.append("      },")
    
    if body_schema:
        lines.append("      body: JSON.stringify(body),")
    
    lines.append("    };")
    lines.append("")
    
    # Add query parameters
    if query_params:
        lines.append("    if (params) {")
        lines.append("      const searchParams = new URLSearchParams();")
        lines.append("      Object.entries(params).forEach(([key, value]) => {")
        lines.append("        if (value !== undefined) searchParams.append(key, String(value));")
        lines.append("      });")
        lines.append("      url += `?${searchParams.toString()}`;")
        lines.append("    }")
        lines.append("")
    
    # Make request
    lines.append("    const response = await fetch(url, options);")
    lines.append("    if (!response.ok) {")
    lines.append("      throw new Error(`HTTP error! status: ${response.status}`);")
    lines.append("    }")
    lines.append("    return response.json();")
    lines.append("  }")
    
    return "\n".join(lines)


def export_service_contracts(
    app: FastAPI,
    service_name: str,
    version: str = "1.0.0",
    output_dir: str = "/tmp/contracts"
) -> Dict[str, str]:
    """Export complete service contracts"""
    
    # Generate OpenAPI spec
    spec_files = generate_openapi_spec(app, service_name, version, output_dir)
    
    # Generate TypeScript types
    typescript_types = extract_typescript_types(spec_files['schema'])
    
    # Save TypeScript file
    output_path = Path(output_dir)
    ts_file = output_path / f"{service_name}-types.ts"
    with open(ts_file, 'w') as f:
        f.write(typescript_types)
    
    return {
        **spec_files,
        'typescript': str(ts_file),
        'types': typescript_types
    }