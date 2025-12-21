# backend/cli/connection_cli.py
"""
연결 관리 CLI 도구
"""

import sys
from pathlib import Path
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.config.connection_selector import get_connection_selector
from backend.config.multi_site_settings import get_multi_site_settings
from backend.api.database.multi_connection_manager import connection_manager

console = Console()


@click.group()
def cli():
    """데이터베이스 연결 관리 도구"""
    pass


@cli.command()
def status():
    """현재 연결 상태 확인"""
    selector = get_connection_selector()
    summary = selector.get_connection_summary()
    
    # 프로필 정보
    console.print(Panel(
        f"[bold cyan]현재 프로필:[/] {summary['current_profile'] or 'None'}",
        title="연결 상태",
        expand=False
    ))
    
    # 통계
    stats = summary['statistics']
    console.print(f"\n[bold]통계:[/]")
    console.print(f"  사이트: {stats['enabled_sites']}/{stats['total_sites']} 활성화")
    console.print(f"  데이터베이스: {stats['enabled_databases']}/{stats['total_databases']} 활성화")
    
    # 활성 연결 테이블
    table = Table(title="\n활성 연결")
    table.add_column("사이트", style="cyan")
    table.add_column("데이터베이스", style="green")
    table.add_column("상태", style="yellow")
    
    for site_id, db_list in summary['enabled_connections'].items():
        for i, db_name in enumerate(db_list):
            site_display = site_id if i == 0 else ""
            table.add_row(site_display, db_name, "✓ 활성화")
    
    console.print(table)


@cli.command()
@click.argument('profile_name')
def load(profile_name):
    """프로필 로드"""
    selector = get_connection_selector()
    
    try:
        selector.load_profile(profile_name)
        selector.save_active_config(updated_by="cli")
        connection_manager.reload_connections()
        
        console.print(f"[green]✓ 프로필 로드 완료: {profile_name}[/]")
        
        # 연결 테스트
        console.print("\n[yellow]연결 테스트 중...[/]")
        results = connection_manager.test_all_active_connections()
        
        success = sum(
            sum(1 for status in dbs.values() if status)
            for dbs in results.values()
        )
        total = sum(len(dbs) for dbs in results.values())
        
        console.print(f"[green]✓ 연결 테스트 완료: {success}/{total} 성공[/]")
        
    except Exception as e:
        console.print(f"[red]✗ 오류: {e}[/]")


@cli.command()
def profiles():
    """프로필 목록 확인"""
    selector = get_connection_selector()
    profile_list = selector.get_profile_list()
    
    table = Table(title="연결 프로필")
    table.add_column("프로필 ID", style="cyan")
    table.add_column("이름", style="green")
    table.add_column("설명")
    table.add_column("연결 수", justify="right")
    table.add_column("활성", justify="center")
    
    for profile in profile_list:
        conn_count = sum(len(dbs) for dbs in profile['connections'].values())
        is_active = "✓" if profile['is_active'] else ""
        
        table.add_row(
            profile['profile_id'],
            profile['name'],
            profile['description'],
            str(conn_count),
            is_active
        )
    
    console.print(table)


@cli.command()
@click.argument('site_id')
@click.option('--enable/--disable', default=True)
def site(site_id, enable):
    """사이트 활성화/비활성화"""
    selector = get_connection_selector()
    
    try:
        selector.enable_site(site_id, enable)
        selector.save_active_config(updated_by="cli")
        connection_manager.reload_connections()
        
        action = "활성화" if enable else "비활성화"
        console.print(f"[green]✓ 사이트 {action}: {site_id}[/]")
        
    except Exception as e:
        console.print(f"[red]✗ 오류: {e}[/]")


@cli.command()
@click.argument('site_id')
@click.argument('db_name')
@click.option('--enable/--disable', default=True)
def database(site_id, db_name, enable):
    """데이터베이스 활성화/비활성화"""
    selector = get_connection_selector()
    
    try:
        selector.enable_database(site_id, db_name, enable)
        selector.save_active_config(updated_by="cli")
        connection_manager.reload_connections()
        
        action = "활성화" if enable else "비활성화"
        console.print(f"[green]✓ 데이터베이스 {action}: {site_id}/{db_name}[/]")
        
    except Exception as e:
        console.print(f"[red]✗ 오류: {e}[/]")


@cli.command()
def test():
    """모든 활성 연결 테스트"""
    console.print("[yellow]연결 테스트 시작...[/]\n")
    
    results = connection_manager.test_all_active_connections()
    
    table = Table(title="연결 테스트 결과")
    table.add_column("사이트", style="cyan")
    table.add_column("데이터베이스", style="green")
    table.add_column("결과", style="yellow")
    
    for site_id, db_results in results.items():
        for i, (db_name, status) in enumerate(db_results.items()):
            site_display = site_id if i == 0 else ""
            result = "[green]✓ 성공[/]" if status else "[red]✗ 실패[/]"
            table.add_row(site_display, db_name, result)
    
    console.print(table)


@cli.command()
def enable_all():
    """모든 사이트/데이터베이스 활성화"""
    selector = get_connection_selector()
    settings = get_multi_site_settings()
    
    try:
        connections = {}
        for site_id in settings.get_all_sites():
            connections[site_id] = settings.get_site_databases(site_id)
        
        selector.enable_multiple(connections, exclusive=True)
        selector.save_active_config(updated_by="cli")
        connection_manager.reload_connections()
        
        console.print("[green]✓ 모든 연결 활성화 완료[/]")
        
    except Exception as e:
        console.print(f"[red]✗ 오류: {e}[/]")


if __name__ == '__main__':
    cli()