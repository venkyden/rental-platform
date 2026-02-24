import asyncio
import os
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def test_mcp_server():
    server_script = os.path.join(os.path.dirname(__file__), "roomivo_mcp.py")

    server_params = StdioServerParameters(
        command=sys.executable,
        args=[server_script],
        env={**os.environ, "PYTHONPATH": os.path.dirname(__file__)},
    )

    print("Connecting to Roomivo MCP Server...")
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            # Initialize the connection
            await session.initialize()

            # List available tools
            print("\n--- Available Tools ---")
            tools = await session.list_tools()
            for tool in tools.tools:
                print(f"- {tool.name}: {tool.description}")

            # Test a specific tool (Dry-Run mode)
            print("\n--- Testing 'get_user_by_email' ---")
            try:
                result = await session.call_tool(
                    "get_user_by_email", arguments={"email": "nonexistent@example.com"}
                )
                print(f"Result:\n{result.content[0].text}")
            except Exception as e:
                print(f"Error calling tool: {e}")


if __name__ == "__main__":
    asyncio.run(test_mcp_server())
