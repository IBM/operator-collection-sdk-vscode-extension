import * as vscode from 'vscode';
import {LinkItem} from "../linkItems/linkItem";
import * as util from "../../utilities/util";

export class LinksTreeProvider implements vscode.TreeDataProvider<LinkItem> {
    getTreeItem(element: LinkItem): vscode.TreeItem {
      return element;
    }
    
    getChildren(element?: LinkItem): LinkItem[] {
        const links: Array<LinkItem> = [];
        if (!element) {
            links.push(new LinkItem("Operator Collection Spec", "Operator Collection specification documentation", new vscode.ThemeIcon("book"), util.Links.ocSpecification));
            links.push(new LinkItem("Report an Issue", "Report an Operator Collection SDK issue", new vscode.ThemeIcon("bug"), util.Links.issues));
            links.push(new LinkItem("Tutorial", "Learn more by trying the Operator Collection development tutorial", new vscode.ThemeIcon("mortar-board"), util.Links.tutorial));
        }

        return links;
    } 
}